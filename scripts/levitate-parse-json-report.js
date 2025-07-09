const fs = require('fs');

const printAffectedPluginsSection = require('./levitate-show-affected-plugins');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

const isFork = Boolean(process.env.IS_FORK || false);

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

const printMarkdownSection = (title, items) => {
  let output = `<h4>${title}</h4>`;
  items.forEach((item) => {
    const language = item.declaration ? 'typescript' : 'diff';
    const code = item.declaration ? item.declaration : stripAnsi(item.diff);

    output += `<b>${item.name}</b><br>\n`;
    output += `<sub>${item.location}</sub><br>\n`;
    output += `<pre lang="${language}">\n${code}\n</pre><br>\n`;
  });
  return output;
};

const printTerminalSection = (title, items) => {
  const colors = {
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m'
  };

  let output = `${colors.bold}${colors.cyan}${title}${colors.reset}\n`;
  output += '='.repeat(title.length) + '\n\n';

  items.forEach((item) => {
    const code = item.declaration ? item.declaration : stripAnsi(item.diff);

    output += `${colors.bold}${item.name}${colors.reset}\n`;
    output += `${colors.dim}${item.location}${colors.reset}\n`;
    output += `${code}\n\n`;
  });

  return output;
};

const printSection = isFork ? printTerminalSection : printMarkdownSection;

let markdown = '';

if (data.removals.length > 0) {
  markdown += printSection('Removals', data.removals);
}
if (data.changes.length > 0) {
  markdown += printSection('Changes', data.changes);
}

// The logic below would need access to secrets for accessing BigQuery, however that's not available on forks.
if ((data.removals.length > 0 || data.changes.length > 0) && !isFork) {
  markdown += printAffectedPluginsSection(data);
}

console.log(markdown);
