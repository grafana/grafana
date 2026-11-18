import { css } from '@emotion/css';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Button, ButtonGroup, Dropdown, Menu, useStyles2 } from '@grafana/ui';

import { AddQueryMenuItems } from './AddQueryMenuItems';
import { useAddNewQuery, useAddTransformation } from './useAddCardActions';

interface QueriesHeaderAddButtonProps {
  onAddQuery: () => void;
  onAddTransformation: () => void;
}

export function QueriesHeaderAddButton({ onAddQuery, onAddTransformation }: QueriesHeaderAddButtonProps) {
  const styles = useStyles2(getStyles);
  const addNewQuery = useAddNewQuery(undefined, onAddQuery);
  const addTransformation = useAddTransformation(undefined, onAddTransformation);

  const addQueryLabel = t('query-editor-next.sidebar.add-query', 'Add query');

  return (
    <ButtonGroup className={styles.alignEnd}>
      <Button
        size="sm"
        variant="secondary"
        icon="plus"
        tooltip={addQueryLabel}
        aria-label={addQueryLabel}
        onClick={addNewQuery}
      >
        {t('query-editor-next.sidebar.add', 'Add')}
      </Button>
      <Dropdown
        overlay={
          <Menu>
            <AddQueryMenuItems onAdd={onAddQuery} />
            <Menu.Divider />
            <Menu.Item
              label={t('query-editor-next.sidebar.add-transformation', 'Add transformation')}
              icon="process"
              onClick={addTransformation}
            />
          </Menu>
        }
        placement="bottom-end"
      >
        <Button
          size="sm"
          variant="secondary"
          icon="angle-down"
          aria-label={t('query-editor-next.sidebar.more-add-options', 'More add options')}
        />
      </Dropdown>
    </ButtonGroup>
  );
}

interface TransformationsHeaderAddButtonProps {
  onAdd: () => void;
}

export function TransformationsHeaderAddButton({ onAdd }: TransformationsHeaderAddButtonProps) {
  const styles = useStyles2(getStyles);
  const addTransformation = useAddTransformation(undefined, onAdd);

  const label = t('query-editor-next.sidebar.add-transformation', 'Add transformation');

  return (
    <Button
      className={styles.alignEnd}
      size="sm"
      variant="secondary"
      icon="plus"
      tooltip={label}
      aria-label={label}
      data-testid={selectors.components.Transforms.addTransformationButton}
      onClick={addTransformation}
    >
      {t('query-editor-next.sidebar.add', 'Add')}
    </Button>
  );
}

const getStyles = () => ({
  // Never let the header row shrink this; the section title truncates instead.
  alignEnd: css({
    marginLeft: 'auto',
    flexShrink: 0,
  }),
});
