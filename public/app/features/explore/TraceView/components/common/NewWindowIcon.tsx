// Copyright (c) 2018 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { css } from '@emotion/css';
import cx from 'classnames';
import React from 'react';

import { Icon, useStyles2 } from '@grafana/ui';

export const getStyles = () => {
  return {
    NewWindowIconLarge: css`
      label: NewWindowIconLarge;
      font-size: 1.5em;
    `,
  };
};

type Props = {
  isLarge?: boolean;
  className?: string;
};

export default function NewWindowIcon(props: Props) {
  const { isLarge, className, ...rest } = props;
  const styles = useStyles2(getStyles);
  const cls = cx({ [styles.NewWindowIconLarge]: isLarge }, className);
  return <Icon className={cls} name={'anchor'} {...rest} />;
}

NewWindowIcon.defaultProps = {
  isLarge: false,
};
