module.exports = async ({ github, context, core, runId, artifactName }) => {
    try {
        const AdmZip = require('adm-zip');
        const fs = require('fs');

        const { owner, repo } = context.repo;
        const { data } = await github.rest.actions.listWorkflowRunArtifacts({
            owner, 
            repo, 
            run_id: runId,
        });
    
        const artifact = data.artifacts.find(a => a.name === artifactName);
        
        if (!artifact) {
            throw new Error(`Could not find artifact ${artifactName} in workflow (${runId})`);
        }
    
        const zip = await github.rest.actions.downloadArtifact({
            owner,
            repo,
            artifact_id: artifact.id,
            archive_format: "zip",
        });
    
        const dir = `./tmp/${artifactName}`;
        await mkdirRecursive(fs, dir);
    
        const admZip = new AdmZip(Buffer.from(zip.data));
        admZip.extractAllTo(dir, true);

        return dir;
    } catch (error) {
        core.restFailed(error.message);
    }
}

async function mkdirRecursive(fs, path) {
    return new Promise((resolve, reject) => {
        fs.mkdir(path, { recursive: true }, (error) => {
            if (error) return reject(error);
            return resolve();
        });
    });
}