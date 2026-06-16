import {appendFileSync, writeFileSync} from 'fs';
import {exec as execCallback} from 'node:child_process';
import {promisify} from 'node:util';
import {findPreviousVersion, semverParse} from "./semver.js";

//
// Github Action core utils: logging (notice + debug log levels), must escape
// newlines and percent signs
//
const escapeData = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const LOG = (msg) => console.log(`::notice::${escapeData(msg)}`);


// Using `git tag -l` output find the tag (version) that goes semantically
// right before the given version. This might not work correctly with some
// pre-release versions, which is why it's possible to pass previous version
// into this action explicitly to avoid this step.
const getPreviousVersion = async (version) => {
  const exec = promisify(execCallback);
  const {stdout} = await exec('git for-each-ref --sort=-creatordate --format \'%(refname:short)\' refs/tags');

  const parsedTags = stdout
    .split('\n')
    .map(semverParse)
    .filter(Boolean);

  const parsedVersion = semverParse(version);
  const prev = findPreviousVersion(parsedTags, parsedVersion);
  if (!prev) {
    throw `Could not find previous git tag for ${version}`;
  }
  return prev[5];
};


// A helper for Github GraphQL API endpoint
const graphql = async (ghtoken, query, variables) => {
  const {env} = process;
  const results = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ghtoken}`,
    },
    body: JSON.stringify({query, variables}),
  });

  const res = await results.json();

  LOG(
    JSON.stringify({
      status: results.status,
      text: results.statusText,
      errors: res.errors,
    })
  );

  return res.data;
};

// A helper for Github REST API endpoints
const rest = async (ghtoken, path) => {
  const results = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Authorization: `Bearer ${ghtoken}`,
    },
  });

  const res = await results.json();

  LOG(
    JSON.stringify({
      status: results.status,
      text: results.statusText,
    })
  );

  return res;
};

// Using Github REST API get a list of commits between the two "commitish" items.
// Use the REST API, rather than the GraphQL API, as the GraphQL ref compare only returns the first 1000 commits.
const getComparison = async (name, owner, from, to) => {
  LOG(`Fetching ${owner}/${name} PRs between ${from} and ${to}`);

  let page = 1;
  let nodes = [];

  for (; ;) {
    const result = await rest(ghtoken, `repos/${owner}/${name}/compare/${from}...${to}?per_page=100&page=${page}`);
    nodes = nodes.concat(result.commits.map(({ sha, node_id }) => ({ sha, node_id })));
    LOG(`Fetched ${result.commits.length} commits, total so far: ${nodes.length}`);

    if (nodes.length >= result.total_commits || !result.commits.length) {
      break;
    }
    page++;
  }

  return nodes;
};

// Using Github GraphQL API get a list of PRs between the two "commitish" items.
// This resolves the diff using the REST API, and then populates PR data from the GraphQL API.
const getHistory = async (name, owner, from, to) => {
  const commits = await getComparison(name, owner, from, to);

  const query = `
    query($nodeIds: [ID!]!) {
      nodes(ids: $nodeIds) {
        ... on Commit {
          oid
          associatedPullRequests(first: 1) {
            nodes {
              title
              number
              labels(first: 10) {
                nodes {
                  name
                }
              }
              commits(first: 1) {
                nodes {
                  commit {
                    author {
                      user {
                        login
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  let nodes = [];

  while (commits.length) {
    const batch = commits.splice(0, 25).map(c => c.node_id);
    const result = await graphql(ghtoken, query, { nodeIds: batch });
    nodes = nodes.concat(result.nodes);
    LOG(`Fetched PRs for ${batch.length} commits, total so far: ${nodes.length}`);
  }

  return nodes;
};

// The main function for this action: given two "commitish" items it gets a
// list of PRs between them and filters/groups the PRs by category (bugfix,
// feature, deprecation, breaking change and plugin fixes/enhancements).
//
// PR grouping relies on Github labels only, not on the PR contents.
const getChangeLogItems = async (name, owner, from, to) => {
  // check if a node contains a certain label
  const hasLabel = ({labels}, label) => labels.nodes.some(({name}) => name === label);
  // get all the PRs between the two "commitish" items
  const history = await getHistory(name, owner, from, to);
  LOG(`History for ${owner}/${name} between ${from} and ${to}: ${history.length} PRs`);

  const items = history.flatMap((node) => {
    // discard PRs without a "changelog" label
    const changes = node.associatedPullRequests.nodes.filter((PR) => hasLabel(PR, 'add to changelog'));
    if (changes.length === 0) {
      return [];
    }
    const item = changes[0];
    const {number, url, labels} = item;
    const title = item.title.replace(/^\[[^\]]+\]:?\s*/, '');
    // for changelog PRs try to find a suitable category.
    // Note that we can not detect "deprecation notices" like that
    // as there is no suitable label yet.
    const isBug = /fix/i.test(title) || hasLabel({labels}, 'type/bug');
    const isBreaking = hasLabel({labels}, 'breaking change');
    const isPlugin =
      hasLabel({labels}, 'area/grafana/ui') ||
      hasLabel({labels}, 'area/grafana/toolkit') ||
      hasLabel({labels}, 'area/grafana/runtime');
    const author = item.commits.nodes[0].commit.author.user?.login;
    return {
      repo: name,
      number,
      title,
      author,
      isBug,
      isPlugin,
      isBreaking,
    };
  });
  return items;
};

// ======================================================
//                 GENERATE CHANGELOG
// ======================================================

LOG(`Changelog action started`);
console.log(process.argv);
const ghtoken = process.env.GITHUB_TOKEN || process.env.INPUT_GITHUB_TOKEN;
if (!ghtoken) {
  throw 'GITHUB_TOKEN is not set and "github_token" input is empty';
}

const target = process.argv[2] || process.env.INPUT_TARGET;
LOG(`Target tag/branch/commit: ${target}`);

const previous = process.argv[3] || process.env.INPUT_PREVIOUS || (await getPreviousVersion(target));

LOG(`Previous tag/commit: ${previous}`);

// Get all changelog items from Grafana OSS
const oss = await getChangeLogItems('grafana', 'grafana', previous, target);
// Get all changelog items from Grafana Enterprise
const entr = await getChangeLogItems('grafana-enterprise', 'grafana', previous, target);

LOG(`Found OSS PRs: ${oss.length}`);
LOG(`Found Enterprise PRs: ${entr.length}`);

// Sort PRs and categorise them into sections
const changelog = [...oss, ...entr]
  .sort((a, b) => (a.title < b.title ? -1 : 1))
  .reduce(
    (changelog, item) => {
      if (item.isPlugin) {
        changelog.plugins.push(item);
      } else if (item.isBug) {
        changelog.bugfixes.push(item);
      } else if (item.isBreaking) {
        changelog.breaking.push(item);
      } else {
        changelog.features.push(item);
      }
      return changelog;
    },
    {
      breaking: [],
      plugins: [],
      bugfixes: [],
      features: [],
    }
  );

// Convert PR numbers to Github links
const pullRequestLink = (n) => `[#${n}](https://github.com/grafana/grafana/pull/${n})`;
// Convert Github user IDs to Github links
const userLink = (u) => `[@${u}](https://github.com/${u})`;

// Now that we have a changelog - we can render some markdown as an output
const markdown = (changelog) => {
  // This convers a list of changelog items into a markdown section with a list of titles/links
  const section = (title, items) =>
    items.length === 0
      ? ''
      : `### ${title}

${items
        .map(
          (item) =>
            `- ${item.title.replace(/^([^:]*:)/gm, '**$1**')} ${
              item.repo === 'grafana-enterprise'
                ? '(Enterprise)'
                : `${pullRequestLink(item.number)}${item.author ? ', ' + userLink(item.author) : ''}`
            }`
        )
        .join('\n')}
  `;

  // Render all present sections for the given changelog
  return `${section('Features and enhancements', changelog.features)}
${section('Bug fixes', changelog.bugfixes)}
${section('Breaking changes', changelog.breaking)}
${section('Plugin development fixes & changes', changelog.plugins)}
`;
};

const md = markdown(changelog);

// Print changelog, mostly for debugging
LOG(`Resulting markdown: ${md}`);

// Save changelog as an output for this action
if (process.env.GITHUB_OUTPUT) {
  LOG(`Output to ${process.env.GITHUB_OUTPUT}`);
  appendFileSync(process.env.GITHUB_OUTPUT, `changelog<<EOF\n${escapeData(md)}\nEOF`);
} else {
  LOG('GITHUB_OUTPUT is not set');
}

// Save changelog as an output file (if requested)
if (process.env.INPUT_OUTPUT_FILE) {
  LOG(`Output to ${process.env.INPUT_OUTPUT_FILE}`);
  writeFileSync(process.env.INPUT_OUTPUT_FILE, md);
}
