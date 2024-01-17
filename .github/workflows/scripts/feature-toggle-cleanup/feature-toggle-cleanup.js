import { parse } from 'csv-parse/sync';
import fs from 'fs';

/***
 * Feauture Flag Structure example
 *  Name: 'disableEnvelopeEncryption',
    Stage: 'GA',
    Owner: '@grafana/grafana-as-code',
    Created: '2022-05-24',
    requiresDevMode: 'false',
    RequiresLicense: 'false',
    RequiresRestart: 'false',
    FrontendOnly: 'false'
 * 
 */


export default function cleanupFeatureFlags() {
	const today = new Date();
	const sixMonthAgo = today.setMonth(today.getMonth() - 6);
	const inputFileContents = fs.readFileSync(process.env.FEATURE_TOGGLES_CSV_FILE_PATH);
	const parsedFeatureFlags = parse(inputFileContents, {
		columns: true,
		skip_empty_lines: true,
		cast: true,
		cast_date: true,
	  });

	// Here we can have the custom logic of how to handle what type of feature flag - e.g. GA can be treated differently than experimental and so on.
	for (const flag of parsedFeatureFlags) {
		if (flag.Created < sixMonthAgo) {
			console.log(`The flag ${flag.Name} was created more than 6 months ago. It should be checked.`);
			console.log(flag);
		}
	}
	

}
