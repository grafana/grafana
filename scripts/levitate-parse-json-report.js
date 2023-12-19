const fs = require('fs');
const crypto = require('crypto');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

const stripAnsi = (string) => string.replace(/\u001b\[.*?m/g, '');

const printSection = (title, items) => {
  let output = `### ${title}\n\n`;
  items.forEach((item) => {
    output += `#### ${item.name}\n`;
    output += `<sub>${item.location}</sub>\n\n`;
    output += '```' + (item.declaration ? 'typescript' : 'diff typescript') + '\n';
    output += item.declaration ? item.declaration : stripAnsi(item.diff);
    output += '\n```\n\n';
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

console.log(base64Encode(markdown));

function base64Encode(str) {
  const buffer = Buffer.from(str, 'utf-8');
  return buffer.toString('base64');
}
