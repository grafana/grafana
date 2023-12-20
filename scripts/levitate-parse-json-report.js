const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

const stripAnsi = (string) => string.replace(/\u001b\[.*?m/g, '');

const printSection = (title, items) => {
  let output = `<br>### ${title}<br>`;
  items.forEach((item) => {
    output += `**${item.name}**<br>`;
    output += `<sub>${item.location}</sub><br>`;
    output += '```' + (item.declaration ? 'typescript' : 'diff typescript');
    output += item.declaration ? item.declaration : stripAnsi(item.diff);
    output += '```<br>';
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

console.log(markdown);
