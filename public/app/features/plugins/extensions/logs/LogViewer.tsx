import { nanoid } from 'nanoid';
import { ReactElement, useMemo } from 'react';
import { useObservable } from 'react-use';

import { SelectableValue } from '@grafana/data';
import {
  EmbeddedScene,
  PanelBuilders,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneQueryRunner,
  sceneUtils,
} from '@grafana/scenes';
import { InlineField, InlineFieldRow, MultiSelect } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { useSelector } from 'app/types/store';

import { ExtensionsLogDataSource } from './dataSource';
import { log } from './log';

const DATASOURCE_REF = {
  uid: nanoid(),
  type: 'grafana-extensions-log',
};

const baseQuery = {
  refId: 'A',
  datasource: {
    uid: DATASOURCE_REF.uid,
  },
};

const dataSource = new ExtensionsLogDataSource(DATASOURCE_REF.type, DATASOURCE_REF.uid, log);
sceneUtils.registerRuntimeDataSource({ dataSource });

export default function PluginExtensionsLog(): ReactElement | null {
  const scene = useLogScene();
  const navModel = useSelector((state) => {
    return getNavModel(state.navIndex, 'extensions');
  });

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <scene.Component model={scene} />
      </Page.Contents>
    </Page>
  );
}

function useLogScene() {
  return useMemo(() => {
    const queryRunner = new SceneQueryRunner({
      datasource: DATASOURCE_REF,
      queries: [baseQuery],
      maxDataPoints: 1000,
      liveStreaming: true,
    });

    return new EmbeddedScene({
      $data: queryRunner,
      body: new SceneFlexLayout({
        children: [
          new SceneFlexItem({
            minHeight: 300,
            body: PanelBuilders.logs().setTitle('Logs').build(),
          }),
        ],
      }),
      controls: [new LogFilterScene(queryRunner, dataSource)],
    });
  }, []);
}

class LogFilterScene extends SceneObjectBase {
  static Component = LogFilterSceneRenderer;

  constructor(
    private queryRunner: SceneQueryRunner,
    private dataSource: ExtensionsLogDataSource
  ) {
    super({});
  }

  public getSelectablePluginIds = (): Array<SelectableValue<string>> => {
    return this.dataSource.getPluginIds().map((id) => ({ label: id, value: id }));
  };

  public getSelectableExtensionPointIds = (): Array<SelectableValue<string>> => {
    return this.dataSource.getExtensionPointIds().map((id) => ({ label: id, value: id }));
  };

  public getSelectableLevels = (): Array<SelectableValue<string>> => {
    return this.dataSource.getLevels().map((id) => ({ label: id, value: id }));
  };

  public onChangePluginIds = (values: Array<SelectableValue<string>>) => {
    const [existingQuery] = this.queryRunner.state.queries;
    this.queryRunner.setState({
      queries: [
        {
          ...existingQuery,
          pluginIds: values.length > 0 ? values.map((v) => v.value) : undefined,
        },
      ],
    });
    this.queryRunner.runQueries();
  };

  public onChangeExtensionPointIds = (values: Array<SelectableValue<string>>) => {
    const [existingQuery] = this.queryRunner.state.queries;
    this.queryRunner.setState({
      queries: [
        {
          ...existingQuery,
          extensionPointIds: values.length > 0 ? values.map((v) => v.value) : undefined,
        },
      ],
    });
    this.queryRunner.runQueries();
  };

  public onChangeLevels = (values: Array<SelectableValue<string>>) => {
    const [existingQuery] = this.queryRunner.state.queries;
    this.queryRunner.setState({
      queries: [
        {
          ...existingQuery,
          levels: values.length > 0 ? values.map((v) => v.value) : undefined,
        },
      ],
    });
    this.queryRunner.runQueries();
  };
}

function LogFilterSceneRenderer({ model }: SceneComponentProps<LogFilterScene>) {
  useObservable(sceneGraph.getData(model).getResultsStream());

  return (
    <InlineFieldRow>
      <InlineField label="Plugin Id">
        <MultiSelect options={model.getSelectablePluginIds()} onChange={model.onChangePluginIds} />
      </InlineField>
      <InlineField label="Extension Points">
        <MultiSelect options={model.getSelectableExtensionPointIds()} onChange={model.onChangeExtensionPointIds} />
      </InlineField>
      <InlineField label="Levels">
        <MultiSelect options={model.getSelectableLevels()} onChange={model.onChangeLevels} />
      </InlineField>
    </InlineFieldRow>
  );
}
