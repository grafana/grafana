/* eslint-disable @emotion/syntax-preference */
import { css, cx } from '@emotion/css';
// BMC Code : Accessibility Change ( Next line )
import React, { CSSProperties, FC, useCallback, useState, useRef, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { styleMixins, stylesFactory, useTheme2, Modal, Icon } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { SEARCH_ITEM_HEIGHT, SEARCH_ITEM_MARGIN } from '../../constants';
import { OnToggleChecked, CalcFieldItem, FieldType, typeMap } from '../../types';
import { getTrimQuery } from '../../utils';

import { SearchCheckbox } from './SearchCheckbox';
import { ViewCalcField } from './ViewCalcField';

export interface Props {
  item: CalcFieldItem;
  editable: boolean;
  onToggleChecked?: OnToggleChecked;
  style?: CSSProperties;
}

const selectors = e2eSelectors.components.ValuePicker;

export const SearchItem: FC<Props> = ({ item, editable, onToggleChecked, style }) => {
  const [isOpen, setModalStatus] = useState(false);
  const theme = useTheme2();
  const styles = getResultsItemStyles(theme, editable);
  // BMC Code : Accessibility Change ( Next line ) | Getting clickable button refs
  const triggerButtonRef = useRef<HTMLDivElement>(null);

  const toggleItem = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (onToggleChecked) {
        onToggleChecked(item);
      }
    },
    [item, onToggleChecked]
  );

  // BMC Code : Accessibility Change starts here.
  // Added true flag to setModalStatus.
  const handleOpenModal = () => {
    setModalStatus(true);
  };

  // Added onRowKeyDown function to trigger modal open/close on each label's space/enter press.
  const onRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.stopPropagation();
      event.preventDefault();

      handleOpenModal();
    }
  };

  // Added handleCloseModal method to refocus the element after modal is closed.
  const handleCloseModal = () => {
    setModalStatus(false);
  };

  // Added useEffect hook to refocus the element afetr modal is closed.
  useEffect(() => {
    if (!isOpen && triggerButtonRef.current) {
      triggerButtonRef.current.focus();
    }
  }, [isOpen]);
  // BMC Code : Accessibility Change ends here.

  const renderItem = () => {
    const query = getTrimQuery(item.sqlQuery);
    return (
      <>
        {
          // BMC Code : Accessibility Change starts here
          // Added role and tabindex for focus for next 3 divs.
        }
        <div role="button" tabIndex={0} style={{ width: '20%', padding: '0 12px' }}>
          <span
            className={styles.label}
            style={{
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              width: '100%',
              display: 'block',
            }}
          >
            {item.formName}
          </span>
        </div>
        <div
          role="button"
          tabIndex={0}
          style={{ fontWeight: 400, fontSize: 'smaller', width: '40%', padding: '0 12px' }}
        >
          <span
            className={styles.label}
            style={{
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              width: '100%',
              display: 'block',
            }}
          >
            {query}
          </span>
        </div>
        <div role="button" tabIndex={0} style={{ width: '16%' }}>
          <div className={styles.body} style={{ justifyContent: 'end', flexDirection: 'row', alignItems: 'center' }}>
            {item.field_type === FieldType.OOTB ? <Icon name="lock" size="sm" /> : ''}
            <span className={styles.label} style={{ fontSize: '12px', fontWeight: 500 }}>
              {item.field_type ? typeMap[item.field_type] : ''}
            </span>
          </div>
        </div>
        {
          // BMC Code : Accessibility Change ends here.
        }
      </>
    );
  };

  return (
    <div
      style={style}
      aria-label={selectors.select(item.name)}
      className={cx(styles.wrapper, { [styles.selected]: item.selected })}
    >
      {
        // BMC Code : Accessibility Change (Next Line)
        // Passing id label and description to SearchCheckbox component to implement checkbox labels.
      }
      <SearchCheckbox
        editable={editable}
        checked={item.checked}
        onClick={toggleItem}
        id={`checkbox-${item.fieldId}`}
        label={item.name}
        description={item.module}
      />
      {editable ? (
        <div
          style={{
            width: '95%',
            height: '100%',
            display: 'inherit',
          }}
        >
          {
            // BMC Code : Accessibility Change (Next Line)
            // Added onRowKeyDown function to trigger modal open/close on each label's space/enter press, added triggerButtonRef ref for accessing the element.
          }
          <div
            className={styles.link}
            ref={triggerButtonRef}
            onClick={handleOpenModal}
            onKeyDown={(event) => onRowKeyDown(event)}
          >
            {renderItem()}
          </div>
        </div>
      ) : (
        renderItem()
      )}
      {
        // BMC Code : Accessibility Change (Next Line)
        // Added handleCloseModal method to refocus the element after modal is closed.
      }
      <Modal
        className={styles.modal}
        title={t('bmc.calc-fields.details', 'Calculated field details')}
        isOpen={isOpen}
        onDismiss={handleCloseModal}
        // BMC Code : Accessibility Change (Next Line)
        ariaLabelledby={t('bmc.calc-fields.details', 'Calculated field details')}
      >
        <ViewCalcField item={item} />
      </Modal>
    </div>
  );
};

export const getInfoIconStyle = (status: number, theme: GrafanaTheme2) => {
  switch (status) {
    // warning
    case 2: {
      return css`
        color: ${theme.colors.warning.name};
      `;
    }
    // error
    case 3: {
      return css`
        color: ${theme.colors.error.name};
      `;
    }
    // ok
    default: {
      return '';
    }
  }
};

const getResultsItemStyles = stylesFactory((theme: GrafanaTheme2, editable: boolean) => ({
  wrapper: css`
    ${styleMixins.listItem(theme)};
    height: ${SEARCH_ITEM_HEIGHT}px;
    width: auto;
    margin-bottom: ${SEARCH_ITEM_MARGIN}px;
    padding: 0 ${theme.spacing(2)};
    &:last-child {
      margin-bottom: ${SEARCH_ITEM_MARGIN * 2}px;
    }
    ${editable ? `hover {cursor: pointer;}` : ''}
    box-shadow: none;
    display: -webkit-box;
    box-sizing: content-box;
    -webkit-align-items: center;
    -webkit-box-align: center;
  `,
  selected: css`
    ${styleMixins.listItemSelected(theme)};
  `,
  body: css`
    align-items: start;
    justify-content: center;
    display: flex;
    flex-flow: column;
    overflow: hidden;
    justify-content: space-between;
  `,
  label: css`
    margin-right: 10px;
  `,
  description: css`
    color: ${theme.colors.text.maxContrast};
    font-size: ${theme.typography.size.xs};
    line-height: ${theme.typography.bodySmall.lineHeight};
    max-width: fit-content;
    position: relative;
  `,
  link: css`
    display: flex;
    flex-wrap: nowrap;
    flex-direction: row;
    align-content: center;
    justify-content: flex-start;
    align-items: center;
    width: inherit;
  `,
  enableStatus: css`
    color: ${theme.colors.success.name};
    min-width: 8%;
    height: 22px;
    padding: 0px 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    margin: 0px 8px;
    border: 1px solid #0064005c;
    background: #0064001c;
  `,
  disableStatus: css`
    color: ${theme.colors.error.name};
    min-width: 8%;
    height: 22px;
    padding: 0px 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    margin: 0px 8px;
    border: 1px solid #6400005c;
    background: #6400005c;
  `,
  modal: css({
    width: '500px',
  }),
}));
