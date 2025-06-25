import { first } from 'lodash';

import { Trans, t } from '@grafana/i18n';
import { Dropdown, ToolbarButton } from '@grafana/ui';

import { ToolbarExtensionPointMenu } from '../ToolbarExtensionPointMenu';

import { ExtensionDropdownProps } from './types';

export function QuerylessAppsExtensions(props: ExtensionDropdownProps) {
  const { links, setSelectedExtension, setIsModalOpen, isModalOpen, noQueriesInPane } = props;

  if (links.length === 0) {
    return undefined;
  }

  const menu = <ToolbarExtensionPointMenu extensions={links} onSelect={setSelectedExtension} />;

  if (links.length === 1) {
    const link = first(links)!;
    return (
      <ToolbarButton variant="canvas" icon={link.icon} onClick={() => setSelectedExtension(link)}>
        <Trans i18nKey="explore.toolbar.add-to-queryless-extensions">Go queryless</Trans>
      </ToolbarButton>
    );
  }

  return (
    <>
      <Dropdown onVisibleChange={setIsModalOpen} placement="bottom-start" overlay={menu}>
        <ToolbarButton
          aria-label={t('explore.queryless-apps-extensions.aria-label-go-queryless', 'Go queryless')}
          disabled={!Boolean(noQueriesInPane)}
          variant="canvas"
          isOpen={isModalOpen}
        >
          <Trans i18nKey="explore.toolbar.add-to-queryless-extensions">Go queryless</Trans>
        </ToolbarButton>
      </Dropdown>
    </>
  );
}
