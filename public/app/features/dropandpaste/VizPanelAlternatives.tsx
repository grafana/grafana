import { useState } from 'react';

import { IconName } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, Stack, Toggletip, ToolbarButton } from '@grafana/ui';

export interface AlternativeActions {
  name: string;
  icon?: IconName;
  onClick?: () => void;
}

interface VizPanelAlternativesState extends SceneObjectState {
  actions: AlternativeActions[];
}

export class VizPanelAlternatives extends SceneObjectBase<VizPanelAlternativesState> {
  static Component = VizPanelMoreRenderer;
}

function VizPanelMoreRenderer({ model }: SceneComponentProps<VizPanelAlternatives>) {
  const [isToggletipOpen, setIsToggletipOpen] = useState(true);
  const { actions } = model.useState();

  return (
    <Toggletip
      fitContent={true}
      show={isToggletipOpen}
      onClose={() => setIsToggletipOpen(false)}
      onOpen={() => setIsToggletipOpen(true)}
      content={
        <Stack gap={1} direction="column">
          <Trans i18nKey="dragndrop.alternative-cta">Want a different look? Select another visualization</Trans>
          <Stack gap={3}>
            {actions.map((item, idx) => (
              <Button size="sm" key={idx} variant="secondary" icon={item.icon} onClick={item.onClick}>
                {item.name}
              </Button>
            ))}
          </Stack>
        </Stack>
      }
    >
      <ToolbarButton icon="ai" />
    </Toggletip>
  );
}
