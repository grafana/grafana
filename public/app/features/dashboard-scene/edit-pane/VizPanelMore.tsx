import { useState } from 'react';

import { IconName } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Box, Button, Icon, Stack, TextLink, Toggletip, ToolbarButton, Tooltip } from '@grafana/ui';

import { useLLMSuggestions } from './llm-suggestions';

export interface AlternativeActions {
  name: string;
  icon?: IconName;
  onClick?: () => void;
}

interface VizPanelMoreState extends SceneObjectState {
  actions: AlternativeActions[];
  source: string;
}

export class VizPanelMore extends SceneObjectBase<VizPanelMoreState> {
  static Component = VizPanelMoreRenderer;
}

function VizPanelMoreRenderer({ model }: SceneComponentProps<VizPanelMore>) {
  const [isToggletipOpen, setIsToggletipOpen] = useState(true);
  const { actions, source } = model.useState();
  sceneGraph.getTimeRange(model).useState();
  const { suggestions, isEnabled, isLoading } = useLLMSuggestions(source);

  return (
    <Toggletip
      title="Explore your data in a new table panel"
      fitContent={true}
      show={isToggletipOpen}
      onClose={() => setIsToggletipOpen(false)}
      onOpen={() => setIsToggletipOpen(true)}
      content={
        <Stack gap={1} direction="column">
          Want a different look? Select another visualization
          <Stack gap={3}>
            {actions.map((item, idx) => (
              <Button size="sm" key={idx} variant="secondary" icon={item.icon} onClick={item.onClick}>
                {item.name}
              </Button>
            ))}
          </Stack>
          {isEnabled && (
            <Box marginTop={1}>
              <Stack gap={1} alignItems="center">
                <Icon name="ai" />
                Discover data sources based on your input
              </Stack>
              {isLoading ? (
                <Icon name="spinner" />
              ) : (
                <Stack gap={1}>
                  {suggestions.length > 0
                    ? suggestions.map(({ datasource, probability, explanation }) => (
                        <TextLink
                          key={datasource.id}
                          href={`/connections/datasources/edit/${datasource.uid}`}
                          variant="bodySmall"
                        >
                          {datasource.typeName} ({probability * 100}% match){' '}
                          <Tooltip content={explanation}>
                            <Icon name="info-circle" />
                          </Tooltip>
                        </TextLink>
                      ))
                    : '-'}
                </Stack>
              )}
            </Box>
          )}
        </Stack>
      }
    >
      <ToolbarButton icon="ai" />
    </Toggletip>
  );
}
