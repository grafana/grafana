import { PluginExtension, PluginExtensionLink, SelectableValue, locationUtil } from '@grafana/data';
import { isPluginExtensionLink, locationService } from '@grafana/runtime';
import { Button, ButtonGroup, ButtonSelect, Modal, Stack, ToolbarButton } from '@grafana/ui';
import { testIds } from '../../testIds';

import { ReactElement, useMemo, useState } from 'react';

type Props = {
  extensions: PluginExtension[];
};

export function ActionButton(props: Props): ReactElement {
  const options = useExtensionsAsOptions(props.extensions);
  const [extension, setExtension] = useState<PluginExtensionLink | undefined>();

  if (options.length === 0) {
    return <Button>Run default action</Button>;
  }

  return (
    <>
      <ButtonGroup>
        <ToolbarButton key="default-action" variant="canvas" onClick={() => alert('You triggered the default action')}>
          Run default action
        </ToolbarButton>
        <ButtonSelect
          data-testid={testIds.actions.button}
          key="select-extension"
          variant="canvas"
          options={options}
          onChange={(option) => {
            const extension = option.value;

            if (isPluginExtensionLink(extension)) {
              if (extension.path) {
                return setExtension(extension);
              }
              if (extension.onClick) {
                return extension.onClick();
              }
            }
          }}
        />
      </ButtonGroup>
      {extension && extension?.path && (
        <LinkModal title={extension.title} path={extension.path} onDismiss={() => setExtension(undefined)} />
      )}
    </>
  );
}

function useExtensionsAsOptions(extensions: PluginExtension[]): Array<SelectableValue<PluginExtension>> {
  return useMemo(() => {
    return extensions.reduce((options: Array<SelectableValue<PluginExtension>>, extension) => {
      if (isPluginExtensionLink(extension)) {
        options.push({
          label: extension.title,
          title: extension.title,
          value: extension,
        });
      }
      return options;
    }, []);
  }, [extensions]);
}

type LinkModelProps = {
  onDismiss: () => void;
  title: string;
  path: string;
};

export function LinkModal(props: LinkModelProps): ReactElement {
  const { onDismiss, title, path } = props;
  const openInNewTab = () => {
    global.open(locationUtil.assureBaseUrl(path), '_blank');
    onDismiss();
  };

  const openInCurrentTab = () => locationService.push(path);

  return (
    <Modal data-testid={testIds.modal.container} title={title} isOpen onDismiss={onDismiss}>
      <Stack direction={'column'}>
        <p>Do you want to proceed in the current tab or open a new tab?</p>
      </Stack>
      <Modal.ButtonRow>
        <Button onClick={onDismiss} fill="outline" variant="secondary">
          Cancel
        </Button>
        <Button type="submit" variant="secondary" onClick={openInNewTab} icon="external-link-alt">
          Open in new tab
        </Button>
        <Button data-testid={testIds.modal.open} type="submit" variant="primary" onClick={openInCurrentTab} icon="apps">
          Open
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
