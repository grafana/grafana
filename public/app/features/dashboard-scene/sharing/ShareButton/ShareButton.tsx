import { css } from '@emotion/css';
import { autoUpdate, useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { FocusScope } from '@react-aria/focus';
import React, { useState } from 'react';
import { useAsyncFn } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, ButtonGroup, ClipboardButton, Portal, useStyles2 } from '@grafana/ui';

import { buildShareUrl } from '../../../dashboard/components/ShareModal/utils';
import { DashboardScene } from '../../scene/DashboardScene';

import ShareMenu from './ShareMenu';

export default function ShareButton({
  // isOpen,
  dashboard,
  // onButtonClick,
}: {
  // isOpen: boolean;
  // onButtonClick: () => void;
  dashboard: DashboardScene;
}) {
  const [isOpen, setOpen] = useState(false);

  const [_, buildUrl] = useAsyncFn(async () => {
    return await buildShareUrl(true, 'current', undefined, true);
  }, [dashboard]);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    placement: 'bottom-end',
    onOpenChange: setOpen,
    // middleware,
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  const styles = useStyles2(getStyles);

  const getAsyncText = async () => {
    return await buildUrl();
  };

  return (
    <ButtonGroup className={styles.container}>
      <ClipboardButton size="sm" getText={getAsyncText}>
        Share link
      </ClipboardButton>
      <Button
        ref={refs.setReference}
        {...getReferenceProps()}
        size="sm"
        icon={isOpen ? 'angle-up' : 'angle-down'}
        onClick={() => setOpen((prevState) => !prevState)}
      />
      {isOpen && (
        <Portal>
          <div {...getFloatingProps()}>
            <FocusScope contain autoFocus restoreFocus>
              <section style={floatingStyles} ref={refs.setFloating}>
                <ShareMenu />
              </section>
            </FocusScope>
          </div>
        </Portal>
      )}
    </ButtonGroup>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      // position: 'relative',
      // display: 'flex',
      // verticalAlign: 'middle',
    }),
    backdrop: css({
      // display: 'none',
      // [theme.breakpoints.down('sm')]: {
      //   display: 'block',
      // },
    }),
    content: css({
      // position: 'absolute',
      // right: 0,
      // top: '116%',
      // zIndex: theme.zIndex.dropdown,
      //
      // [theme.breakpoints.down('sm')]: {
      //   position: 'fixed',
      //   right: '50%',
      //   top: '50%',
      //   transform: 'translate(50%, -50%)',
      //   zIndex: theme.zIndex.modal,
      // },
    }),
  };
};
