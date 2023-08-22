module.exports = async ({ core, filePath }) => {
    try {
        const fs = require('fs').promises;
        const content = await fs.readFile(filePath)
        const result = JSON.parse(content);
    
        core.startGroup('Parsing json file...');

        for (const property in result) {
            core.info(`${property} <- ${result[property]}`);
            core.setOutput(property, result[property]);
        }

        core.endGroup();
    } catch (error) {
        core.setFailed(error.message);
    }
}