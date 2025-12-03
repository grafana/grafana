import { css } from '@emotion/css';

import { CoreApp, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Dropdown, Menu, ToolbarButton, useStyles2, useTheme2 } from '@grafana/ui';
import { Block } from 'app/types/explore';

import { useDispatch } from '../../types/store';

import { useQueryLibraryContext } from './QueryLibrary/QueryLibraryContext';
import { type OnSelectQueryType } from './QueryLibrary/types';
import { addBlock } from './state/query';

type Props = {
  queryInspectorButtonActive?: boolean;
  onClickQueryInspectorButton: () => void;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    containerMargin: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      marginTop: theme.spacing(2),
    }),
    addBlockButton: css({
      alignSelf: 'flex-start',
    }),
  };
};

export function SecondaryActions({ onClickQueryInspectorButton, queryInspectorButtonActive }: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div className={styles.containerMargin}>
      <ToolbarButton
        variant={queryInspectorButtonActive ? 'active' : 'canvas'}
        aria-label={t('explore.secondary-actions.query-inspector-button-aria-label', 'Query inspector')}
        onClick={onClickQueryInspectorButton}
        icon="info-circle"
      >
        <Trans i18nKey="explore.secondary-actions.query-inspector-button">Query inspector</Trans>
      </ToolbarButton>
    </div>
  );
}

export function AddQueryButtons({
  addQueryRowButtonDisabled,
  addQueryRowButtonHidden,
  onClickAddQueryRowButton,
  exploreId,
  onSelectQueryFromLibrary,
}: {
  addQueryRowButtonDisabled?: boolean;
  addQueryRowButtonHidden?: boolean;

  onClickAddQueryRowButton: () => void;
  exploreId: string;
  onSelectQueryFromLibrary: OnSelectQueryType;
}) {
  const { queryLibraryEnabled, openDrawer: openQueryLibraryDrawer } = useQueryLibraryContext();

  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const blockOptions: Array<{ label: string; value: Block['type'] }> = [
    { label: t('explore.secondary-actions.block-type-query', 'Query block'), value: 'query' },
    { label: t('explore.secondary-actions.block-type-text', 'Text block'), value: 'text' },
    { label: t('explore.secondary-actions.block-type-expression', 'Expression block'), value: 'expression' },
  ];

  const createBlock = (type: Block['type']): Block | null => {
    if (type === 'text') {
      return { type: 'text', text: '' };
    }
    if (type === 'expression') {
      return { type: 'expression', expression: '' };
    }
    return null;
  };

  const onAddBlock = (type: Block['type']) => {
    if (type === 'query') {
      onClickAddQueryRowButton();
      return;
    }

    const block = createBlock(type);
    if (block) {
      dispatch(addBlock(exploreId, block));
    }
  };

  const addBlockMenu = (
    <Menu>
      {blockOptions.map((option) => (
        <Menu.Item key={option.value} label={option.label} onClick={() => onAddBlock(option.value)} icon="plus" />
      ))}
    </Menu>
  );

  return (
    !addQueryRowButtonHidden && (
      <>
        <Dropdown overlay={addBlockMenu} placement="bottom-start">
          <ToolbarButton
            variant="canvas"
            aria-label={t('explore.secondary-actions.block-add-button-aria-label', 'Add block')}
            disabled={addQueryRowButtonDisabled}
            icon="plus"
            className={styles.addBlockButton}
          >
            <Trans i18nKey="explore.secondary-actions.block-add-button">Add block</Trans>
          </ToolbarButton>
        </Dropdown>
        {queryLibraryEnabled && (
          <ToolbarButton
            data-testid={selectors.pages.Explore.General.addFromQueryLibrary}
            aria-label={t('explore.secondary-actions.add-from-query-library', 'Add from saved queries')}
            variant="canvas"
            onClick={() =>
              openQueryLibraryDrawer({
                onSelectQuery: onSelectQueryFromLibrary,
                options: { context: CoreApp.Explore },
              })
            }
            icon="plus"
            disabled={addQueryRowButtonDisabled}
          >
            <Trans i18nKey="explore.secondary-actions.add-from-query-library">Add from saved queries</Trans>
          </ToolbarButton>
        )}
      </>
    )
  );
}
