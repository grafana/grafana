module.exports = async ({ core, filePath }) => {
    try {
        const fs = require('fs');
        const content = await readFile(fs, filePath);
        const result = JSON.parse(content);
    
        core.startGroup('Parsing json file...');

        for (const property in result) {
            core.info(`${property} <- ${result[property]}`);
            core.setOutput(property, result[property]);
        }

        core.endGroup();
    } catch (error) {
        core.restFailed(error.message);
    }
}

async function readFile(fs, path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (error, data) => {
            if (error) return reject(error);
            return resolve(data);
        });
    });
}