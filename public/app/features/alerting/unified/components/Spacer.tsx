import { css } from '@emotion/css';
import React from 'react';

/**
 * A simple "flex: 1;" component you can use in combination with the Stack component(s), like so
 *
 *  <Stack direction="row">
 *    <span>hello</span>
 *    <Spacer />
 *    <span>world</span>
 *  </Stack>
 */

export const Spacer = () => (
  <span
    className={css`
      flex: 1;
    `}
  />
);
