import { css } from '@emotion/css';
import { FC } from 'react';

import { GrafanaTheme } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { ConfirmModal, stylesFactory, useTheme } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { CalcFieldItem, CalcFieldModule, OnDeleteItems, SearchLayout } from '../../types';
import { getCheckedIds } from '../../utils';

interface Props {
  onDeleteItems: OnDeleteItems;
  results: CalcFieldModule[] | CalcFieldItem[];
  isOpen: boolean;
  onDismiss: () => void;
  layout: SearchLayout.Module | SearchLayout.List;
}

export const ConfirmDeleteModal: FC<Props> = ({ results, onDeleteItems, isOpen, onDismiss, layout }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const fields = getCheckedIds(results, layout);

  let text = t('bmc.calc-fields.confirm-delete', 'Do you want to delete the selected calculated field(s)');

  const deleteItems = () => {
    onDeleteItems(fields.map((item) => Number((item.fieldId as string).split('_')[1])))
      .then(() => {
        onDismiss();
        locationService.push({ pathname: '/calculated-fields' });
      })
      .finally(() => {
        onDismiss();
      });
  };

  const deleteText = t('bmc.calc-fields.delete', 'Delete');
  const cancelText = t('bmc.common.cancel', 'Cancel');
  return isOpen ? (
    <ConfirmModal
      isOpen={isOpen}
      title={deleteText}
      body={
        <>
          {text}
          {
            <div className={styles.subtitle}>
              {fields.map((item: CalcFieldItem) => {
                return <span key={item.name}>{`${item.module} -> ${item.name}`}</span>;
              })}
            </div>
          }
        </>
      }
      confirmText={deleteText}
      dismissText={cancelText}
      onConfirm={deleteItems}
      onDismiss={onDismiss}
    />
  ) : null;
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    subtitle: css`
      font-size: ${theme.typography.size.base};
      padding-top: ${theme.spacing.md};
      display: flex;
      flex-direction: column;
    `,
  };
});
