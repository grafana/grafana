import { nanoid } from 'nanoid';
import { ReactElement, useMemo } from 'react';

import { DataFrame, PanelData } from '@grafana/data';
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

sceneUtils.registerRuntimeDataSource({
  dataSource: new ExtensionsLogDataSource(DATASOURCE_REF.type, DATASOURCE_REF.uid, log),
});

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
      controls: [new LogFilterScene(queryRunner)],
    });
  }, []);
}

class LogFilterScene extends SceneObjectBase {
  static Component = LogFilterSceneRenderer;

  constructor(private queryRunner: SceneQueryRunner) {
    super({});
  }

  public onFilter = () => {
    this.queryRunner.setState({
      queries: [
        {
          ...baseQuery,
          filter: true,
        },
      ],
    });
    this.queryRunner.runQueries();
  };
}

function LogFilterSceneRenderer({ model }: SceneComponentProps<LogFilterScene>) {
  const { data } = sceneGraph.getData(model).useState();
  const options = useFilterOptions(data);
  console.log('options', { options });

  return (
    <div>
      <pre>{JSON.stringify(data?.request)}</pre>
      <pre>{JSON.stringify(data?.series)}</pre>
    </div>
  );
}

type FilterOptions = {
  pluginIds: Set<string>;
  extensionPoints: Set<string>;
  levels: Set<string>;
};

function useFilterOptions(data: PanelData | undefined): FilterOptions {
  return useMemo(() => {
    const series: DataFrame[] = data?.series ?? [];

    const options: FilterOptions = {
      pluginIds: new Set<string>(),
      extensionPoints: new Set<string>(),
      levels: new Set<string>(),
    };

    for (const serie of series) {
      for (const field of serie.fields) {
        if (field.name === 'severity') {
          for (const value of field.values) {
            options.levels.add(value);
          }
        }

        if (field.name === 'labels') {
          for (const value of field.values) {
            const { extensionPointId, pluginId } = value;
            if (extensionPointId) {
              options.extensionPoints.add(extensionPointId);
            }
            if (pluginId) {
              options.pluginIds.add(pluginId);
            }
          }
        }
      }
    }

    return options;
  }, [data]);
}
