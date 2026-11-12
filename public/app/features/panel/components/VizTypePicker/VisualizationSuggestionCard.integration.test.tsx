import { render, screen } from '@testing-library/react';
import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import {
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { getTemplateSrv, setTemplateSrv, type TemplateSrv } from '@grafana/runtime';
import { setPanelPluginMetas } from '@grafana/runtime/internal';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { VisualizationSuggestionCard } from './VisualizationSuggestionCard';

standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

describe('VisualizationSuggestionCard', () => {
  let previousTemplateSrv: TemplateSrv;

  beforeAll(() => {
    previousTemplateSrv = getTemplateSrv();
    setTemplateSrv(
      initTemplateSrv('suggestion-card', [
        { type: 'constant', name: 'region', current: { value: 'eu-west', text: 'eu-west' } },
      ])
    );
    setPanelPluginMetas({ stat: getPanelPlugin({ id: 'stat', module: 'core:plugin/stat' }).meta });
  });

  afterAll(() => {
    setTemplateSrv(previousTemplateSrv);
    setPanelPluginMetas({});
  });

  it('shows dashboard variables, field macros and data macros resolved in the preview', async () => {
    const data: PanelData = {
      series: [
        toDataFrame({
          fields: [
            { name: 'service', type: FieldType.string, values: ['API', 'Worker'] },
            {
              name: 'availability',
              type: FieldType.number,
              values: [99.9, 97.5],
              config: { displayName: '${__data.fields.service} ${__field.name} in $region' },
            },
          ],
        }),
      ],
      state: LoadingState.Done,
      timeRange: getDefaultTimeRange(),
    };

    render(
      <VisualizationSuggestionCard
        data={data}
        suggestion={{ pluginId: 'stat', name: 'Stat', hash: 'stat', options: { reduceOptions: { values: true } } }}
        width={200}
      />
    );

    expect(await screen.findByText('API availability in eu-west')).toBeInTheDocument();
    expect(screen.getByText('Worker availability in eu-west')).toBeInTheDocument();
  });
});
