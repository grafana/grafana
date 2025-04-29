import { appendFileSync, writeFileSync } from 'fs';
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';

//
// Github Action core utils: logging (notice + debug log levels), must escape
// newlines and percent signs
//
const escapeData = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const LOG = (msg) => console.log(`::notice::${escapeData(msg)}`);

//
// Semver utils: parse, compare, sort etc (using official regexp)
// https://regex101.com/r/Ly7O1x/3/
//
const semverRegExp =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const semverParse = (tag) => {
  const m = tag.match(semverRegExp);
  if (!m) {
    return;
  }
  const [_, major, minor, patch, prerelease] = m;
  return [+major, +minor, +patch, prerelease, tag];
};

// semverCompare takes two parsed semver tags and comparest them more or less
// according to the semver specs
const semverCompare = (a, b) => {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) {
      return a[i] < b[i] ? 1 : -1;
    }
  }
  if (a[3] !== b[3]) {
    return a[3] < b[3] ? 1 : -1;
  }
  return 0;
};

// Using `git tag -l` output find the tag (version) that goes semantically
// right before the given version. This might not work correctly with some
// pre-release versions, which is why it's possible to pass previous version
// into this action explicitly to avoid this step.
const getPreviousVersion = async (version) => {
  const exec = promisify(execCallback);
  const { stdout } = await exec('git tag -l');
  const prev = stdout
    .split('\n')
    .map(semverParse)
    .filter((tag) => tag)
    .sort(semverCompare)
    .find((tag) => semverCompare(tag, semverParse(version)) > 0);
  if (!prev) {
    throw `Could not find previous git tag for ${version}`;
  }
  return prev[4];
};

// A helper for Github GraphQL API endpoint
const graphql = async (ghtoken, query, variables) => {
  const { env } = process;
  const results = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ghtoken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const res = await results.json();

  LOG(
    JSON.stringify({
      status: results.status,
      text: results.statusText,
    })
  );

  return res.data;
};

// Using Github GraphQL API find the timestamp for the given tag/commit hash.
// This is required for PR listing, because Github API only takes date/time as
// a "since" parameter while listing. Currently there is no way to provide two
// "commitish" items and get a list of PRs in between them.
const getCommitishDate = async (name, owner, target) => {
  const result = await graphql(
    ghtoken,
    `
      query getCommitDate($owner: String!, $name: String!, $target: String!) {
        repository(owner: $owner, name: $name) {
          object(expression: $target) {
            ... on Commit {
              committedDate
            }
          }
        }
      }
    `,
    { name, owner, target }
  );
  return result.repository.object.committedDate;
};

// Using Github GraphQL API get a list of PRs between the two "commitish" items.
// This resoves the "since" item's timestamp first and iterates over all PRs
// till "target" using naïve pagination.
const getHistory = async (name, owner, from, to) => {
  LOG(`Fetching ${owner}/${name} PRs between ${from} and ${to}`);
  const query = `
  query findCommitsWithAssociatedPullRequests(
    $name: String!
    $owner: String!
    $from: String!
    $to: String!
    $cursor: String
  ) {
    repository(name: $name, owner: $owner) {
      ref(qualifiedName: $from) {
        compare(headRef: $to) {
          commits(first: 25, after: $cursor) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
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
      }
    }
  }`;

  let cursor;
  let nodes = [];
  for (;;) {
    const result = await graphql(ghtoken, query, {
      name,
      owner,
      from,
      to,
      cursor,
    });
    LOG(`GraphQL: ${JSON.stringify(result)}`);
    nodes = [...nodes, ...result.repository.ref.compare.commits.nodes];
    const { hasNextPage, endCursor } = result.repository.ref.compare.commits.pageInfo;
    if (!hasNextPage) {
      break;
    }
    cursor = endCursor;
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
  const hasLabel = ({ labels }, label) => labels.nodes.some(({ name }) => name === label);
  // get all the PRs between the two "commitish" items
  const history = await getHistory(name, owner, from, to);

  const items = history.flatMap((node) => {
    // discard PRs without a "changelog" label
    const changes = node.associatedPullRequests.nodes.filter((PR) => hasLabel(PR, 'add to changelog'));
    if (changes.length === 0) {
      return [];
    }
    const item = changes[0];
    const { number, url, labels } = item;
    const title = item.title.replace(/^\[[^\]]+\]:?\s*/, '');
    // for changelog PRs try to find a suitable category.
    // Note that we can not detect "deprecation notices" like that
    // as there is no suitable label yet.
    const isBug = /fix/i.test(title) || hasLabel({ labels }, 'type/bug');
    const isBreaking = hasLabel({ labels }, 'breaking change');
    const isPlugin =
      hasLabel({ labels }, 'area/grafana/ui') ||
      hasLabel({ labels }, 'area/grafana/toolkit') ||
      hasLabel({ labels }, 'area/grafana/runtime');
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
