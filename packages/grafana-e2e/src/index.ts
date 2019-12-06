import { Pages } from './pages';
import { Flows } from './flows';
import { e2eScenario } from './support';

// @ts-ignore yarn start in root throws error otherwise
const e2eImgSrcToBlob = (url: string) => Cypress.Blob.imgSrcToBlob(url);
// @ts-ignore yarn start in root throws error otherwise
const e2eBlobToBase64String = (blob: any) => Cypress.Blob.blobToBase64String(blob);
// @ts-ignore yarn start in root throws error otherwise
const e2eConfig = () => Cypress.config();
// @ts-ignore yarn start in root throws error otherwise
const e2eEnv = (args: string) => Cypress.env(args);
// @ts-ignore yarn start in root throws error otherwise
const e2e = () => cy;

export { Pages, Flows, e2eScenario, e2eImgSrcToBlob, e2eBlobToBase64String, e2eConfig, e2eEnv, e2e };
