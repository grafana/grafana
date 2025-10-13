// Libraries
import { getDataTrailsApp } from './DataTrailsApp';

export function DataTrailsPage() {
  const app = getDataTrailsApp();
  return <app.Component model={app} />;
}

export default DataTrailsPage;
