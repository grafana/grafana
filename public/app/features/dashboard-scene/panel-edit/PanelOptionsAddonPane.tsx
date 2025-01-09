import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { sceneGraph } from '@grafana/scenes';
import { Box } from '@grafana/ui';
import { AddonBarPane } from 'app/core/components/AppChrome/AddonBar/AddonBarPane';
import { OptionFilter } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { VisualizationSuggestions } from 'app/features/panel/components/VizTypePicker/VisualizationSuggestions';

import { PanelModelCompatibilityWrapper } from '../utils/PanelModelCompatibilityWrapper';

import { PanelEditor } from './PanelEditor';
import { PanelOptions } from './PanelOptions';

interface Props {
  editor: PanelEditor;
  show?: string;
  title: string;
}

export function PanelOptionsAddonPane({ editor, show, title }: Props) {
  // const styles = useStyles2(getStyles);
  //   const navIndex = useSelector((s) => s.navIndex);
  //   const helpNode = cloneDeep(navIndex['help']);
  //   const enrichedHelpNode = helpNode ? enrichHelpItem(helpNode) : undefined;
  const { panelRef } = editor.useState();
  const panel = panelRef.resolve();
  const { pluginId } = panel.useState();
  const { data } = sceneGraph.getData(panel).useState();

  return (
    <AddonBarPane title={title}>
      <PanelOptions show={show} panel={panel} searchQuery={''} listMode={OptionFilter.All} data={data} />
    </AddonBarPane>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    divider: css({
      height: '1px',
      width: '100%',
    }),
    input: css({
      boxShadow: 'none',
      width: '100%',
      border: `1px solid ${theme.components.input.borderColor}`,
      background: theme.components.input.background,
      padding: theme.spacing(1),
      borderRadius: theme.shape.borderRadius(3),
    }),
  };
}

interface Props2 {
  editor: PanelEditor;
}

export function VisualizationSuggestionsPane({ editor }: Props2) {
  // const styles = useStyles2(getStyles);
  //   const navIndex = useSelector((s) => s.navIndex);
  //   const helpNode = cloneDeep(navIndex['help']);
  //   const enrichedHelpNode = helpNode ? enrichHelpItem(helpNode) : undefined;
  const { panelRef } = editor.useState();
  const panel = panelRef.resolve();
  const { pluginId } = panel.useState();
  const { data } = sceneGraph.getData(panel).useState();
  const panelModel = useMemo(() => new PanelModelCompatibilityWrapper(panel), [panel]);

  return (
    <AddonBarPane title={'Visualization suggestions'}>
      <Box padding={1} grow={1}>
        <VisualizationSuggestions
          onChange={() => {}}
          trackSearch={() => {}}
          searchQuery={''}
          panel={panelModel}
          data={data}
        />
      </Box>
    </AddonBarPane>
  );
}
