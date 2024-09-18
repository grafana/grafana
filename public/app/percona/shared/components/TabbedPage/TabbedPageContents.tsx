import { cx } from '@emotion/css';
import React, { ComponentProps, FC } from 'react';

import { Page } from 'app/core/components/Page/Page';

import { styles } from './TabbedPageContents.styles';

export const TabbedPageContents: FC<ComponentProps<typeof Page.Contents>> = ({ children, className, ...props }) => (
  <Page.Contents {...props} className={cx('page-container', 'page-body', styles.Contents, className)}>
    {children}
  </Page.Contents>
);
