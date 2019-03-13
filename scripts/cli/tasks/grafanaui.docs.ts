import execa from 'execa';
import { Task, TaskRunner } from './task';
import { metadataGenerationTask } from './grafanaui.metadata';
import { changeCwdToGrafanaUi } from '../utils/cwd';
import { useSpinner } from '../utils/useSpinner';

interface DocsDevTaskOptions {}

const generateMetadata = useSpinner<void>('Generating @grafana/ui metadata', metadataGenerationTask.exec);

const docsDevRunner: TaskRunner<DocsDevTaskOptions> = async () => {
  await generateMetadata();
  changeCwdToGrafanaUi();
  execa('yarn', ['run', 'docs:dev'], { stdio: 'inherit' });
};

export const docsDevTask = new Task<DocsDevTaskOptions>();
docsDevTask.setName('Docs development');
docsDevTask.setRunner(docsDevRunner);
