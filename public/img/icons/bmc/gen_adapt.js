let fs = require('fs');
let path = require('path');

const ADAPT_FOLDER = './adapt';

const generateAdaptIcons = () => {
  let adaptIconsFiles = fs.readdirSync(ADAPT_FOLDER);
  adaptIconsFiles.forEach((file) => {
    if (file.includes('bmc-')) {
      return;
    }
    const fileName = file.slice(file.indexOf('-'));
    const newFileName = `bmc${fileName}`;

    const oldFilePath = path.join(ADAPT_FOLDER, file);
    const newFilePath = path.join(ADAPT_FOLDER, newFileName);

    fs.rename(oldFilePath, newFilePath, () => {
      console.log(`Renaming ${oldFilePath} -> ${newFilePath}`);
    });
  });
};

const generateAdaptTxt = () => {
  let adaptIconsFiles = fs.readdirSync(ADAPT_FOLDER);
  let iconsList = [];
  adaptIconsFiles.forEach((file) => {
    const iconName = file.split('.')[0];
    iconsList.push(`'${iconName}'`);
  });
  fs.writeFile('./adapt.txt', iconsList.join(' | '), () => {
    console.log('Creating adapt.txt');
  });
};

try {
  generateAdaptIcons();
  generateAdaptTxt();
} catch (err) {
  console.error(err);
}
