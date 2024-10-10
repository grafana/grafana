const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

const printSection = (title, items) => {
  let output = `#### ${title}\n\n`;
  items.forEach((item) => {
    const language = item.declaration ? 'typescript' : 'diff';
    const code = item.declaration ? item.declaration : stripAnsi(item.diff);

    output += `**${item.name}**\n\n`;
    output += `${item.location}\n\n`;
    output += `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
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
