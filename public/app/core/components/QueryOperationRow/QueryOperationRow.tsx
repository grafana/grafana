import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import * as React from 'react';
import { useUpdateEffect } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { ReactUtils, useStyles2 } from '@grafana/ui';

import { QueryOperationRowHeader, ExpanderMessages } from './QueryOperationRowHeader';

export interface QueryOperationRowProps {
  index: number;
  id: string;
  title?: string;
  headerElement?: QueryOperationRowRenderProp;
  actions?: QueryOperationRowRenderProp;
  onOpen?: () => void;
  onClose?: () => void;
  children: React.ReactNode;
  isOpen?: boolean;
  collapsable?: boolean;
  disabled?: boolean;
  expanderMessages?: ExpanderMessages;
}

export type QueryOperationRowRenderProp = ((props: QueryOperationRowRenderProps) => React.ReactNode) | React.ReactNode;

export interface QueryOperationRowRenderProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export function QueryOperationRow({
  children,
  actions,
  title,
  headerElement,
  onClose,
  onOpen,
  isOpen,
  disabled,
  collapsable,
  index,
  id,
  expanderMessages,
}: QueryOperationRowProps) {
  const [isContentVisible, setIsContentVisible] = useState(isOpen !== undefined ? isOpen : true);
  const styles = useStyles2(getQueryOperationRowStyles);
  const onRowToggle = useCallback(() => {
    setIsContentVisible(!isContentVisible);
  }, [isContentVisible, setIsContentVisible]);

  // Force QueryOperationRow expansion when `isOpen` prop updates in parent component.
  // `undefined` can be deliberately passed value here, but we only want booleans to trigger the effect.
  useEffect(() => {
    if (typeof isOpen === 'boolean') {
      setIsContentVisible(isOpen);
    }
  }, [isOpen]);

  useUpdateEffect(() => {
    if (isContentVisible) {
      if (onOpen) {
        onOpen();
      }
    } else {
      if (onClose) {
        onClose();
      }
    }
  }, [isContentVisible]);

  const renderPropArgs: QueryOperationRowRenderProps = {
    isOpen: isContentVisible,
    onOpen: () => {
      setIsContentVisible(true);
    },
    onClose: () => {
      setIsContentVisible(false);
    },
  };

  const actionsElement = actions && ReactUtils.renderOrCallToRender(actions, renderPropArgs);
  const headerElementRendered = headerElement && ReactUtils.renderOrCallToRender(headerElement, renderPropArgs);

  return (
    <div className={styles.wrapper}>
      <QueryOperationRowHeader
        id={id}
        actionsElement={actionsElement}
        disabled={disabled}
        collapsable={collapsable}
        headerElement={headerElementRendered}
        isContentVisible={isContentVisible}
        onRowToggle={onRowToggle}
        title={title}
        expanderMessages={expanderMessages}
      />
      {isContentVisible && <div className={styles.content}>{children}</div>}
    </div>
  );
}

const getQueryOperationRowStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      marginBottom: theme.spacing(2),
    }),
    content: css({
      marginTop: theme.spacing(0.5),
      marginLeft: theme.spacing(3),
    }),
  };
};

QueryOperationRow.displayName = 'QueryOperationRow';
