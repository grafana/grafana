const fs = require('fs');

const printAffectedPluginsSection = require('./levitate-show-affected-plugins');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

const isFork = Boolean(process.env.IS_FORK || false);

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

const printSection = (title, items) => {
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
