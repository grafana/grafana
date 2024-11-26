import { ReactSVG, useState } from 'react';

import { NavModelItem } from '@grafana/data';
import { getPluginExtensions, isPluginExtensionLink } from '@grafana/runtime';
import { VizGridLayout } from '@grafana/scenes-react';
import {
  Button,
  Checkbox,
  ElementSelectionContext,
  ElementSelectionContextState,
  LinkButton,
  PanelChrome,
  Stack,
  Text,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useAppNotification } from 'app/core/copy/appNotification';

export const TestStuffPage = () => {
  const node: NavModelItem = {
    id: 'test-page',
    text: 'Test page',
    icon: 'dashboard',
    subTitle: 'FOR TESTING!',
    url: 'sandbox/test',
  };

  const notifyApp = useAppNotification();
  const [elementSelectionState, setElementSelectionState] = useState<ElementSelectionContextState>({
    selected: [],
    enabled: true,
    onSelect: (item, multi) => {
      setElementSelectionState((state) => {
        const selected = state.selected;
        const isSelected = selected.some((selectedItem) => selectedItem.id === item.id);

        if (multi) {
          if (isSelected) {
            return {
              ...state,
              selected: selected.filter((selectedItem) => selectedItem.id !== item.id),
            };
          } else {
            return {
              ...state,
              selected: [...selected, item],
            };
          }
        } else {
          return {
            ...state,
            selected: isSelected ? [] : [item],
          };
        }
      });
    },
  });

  const onToggleElementSelection = () => {
    setElementSelectionState({ ...elementSelectionState, enabled: !elementSelectionState.enabled });
  };

  const onClearSelection = (evt: React.PointerEvent) => {
    setElementSelectionState({ ...elementSelectionState, selected: [] });
  };

  return (
    <Page navModel={{ node: node, main: node }}>
      <Stack direction={'column'} gap={2} onPointerUp={onClearSelection}>
        <LinkToBasicApp extensionPointId="grafana/sandbox/testing" />
        <Text variant="h5">Application notifications (toasts) testing</Text>
        <Stack>
          <Button onClick={() => notifyApp.success('Success toast', 'some more text goes here')} variant="primary">
            Success
          </Button>
          <Button
            onClick={() => notifyApp.warning('Warning toast', 'some more text goes here', 'bogus-trace-99999')}
            variant="secondary"
          >
            Warning
          </Button>
          <Button
            onClick={() => notifyApp.error('Error toast', 'some more text goes here', 'bogus-trace-fdsfdfsfds')}
            variant="destructive"
          >
            Error
          </Button>
        </Stack>
        <Stack gap={3} alignItems={'center'}>
          <Checkbox
            label="Enable element selection"
            value={elementSelectionState.enabled}
            onChange={() => onToggleElementSelection()}
          />
          Selected:
          {elementSelectionState.selected.map((item) => (
            <span key={item.id}>{item.id}</span>
          ))}
        </Stack>
        <ElementSelectionContext.Provider value={elementSelectionState}>
          <VizGridLayout>
            <PanelChrome title={'Panel title 1'} selectionId="panel-1">
              Hello
            </PanelChrome>
            <PanelChrome title={'Panel title 2'} selectionId="panel-2">
              Hello
            </PanelChrome>
            <PanelChrome title={'Panel title 3'} selectionId="panel-3">
              Hello
            </PanelChrome>
            <PanelChrome title={'Panel title 4'} selectionId="panel-4">
              Hello
            </PanelChrome>
          </VizGridLayout>
        </ElementSelectionContext.Provider>
      </Stack>
    </Page>
  );
};

function LinkToBasicApp({ extensionPointId }: { extensionPointId: string }) {
  const { extensions } = getPluginExtensions({ extensionPointId });

  if (extensions.length === 0) {
    return null;
  }

  return (
    <div>
      {extensions.map((extension, i) => {
        if (!isPluginExtensionLink(extension)) {
          return null;
        }
        return (
          <LinkButton href={extension.path} title={extension.description} key={extension.id}>
            {extension.title}
          </LinkButton>
        );
      })}
    </div>
  );
}

export default TestStuffPage;
