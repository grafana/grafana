import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Constraint, HorizontalConstraint, VerticalConstraint } from 'app/features/canvas';

interface Props {
  onVerticalConstraintChange: (v: VerticalConstraint) => void;
  onHorizontalConstraintChange: (h: HorizontalConstraint) => void;
  currentConstraints: Constraint;
}

export const ConstraintSelectionBox = ({
  onVerticalConstraintChange,
  onHorizontalConstraintChange,
  currentConstraints,
}: Props) => {
  const styles = useStyles2(getStyles);

  const onClickTopConstraint = () => {
    onVerticalConstraintChange(VerticalConstraint.Top);
  };

  const onClickBottomConstraint = () => {
    onVerticalConstraintChange(VerticalConstraint.Bottom);
  };

  const onClickLeftConstraint = () => {
    onHorizontalConstraintChange(HorizontalConstraint.Left);
  };

  const onClickRightConstraint = () => {
    onHorizontalConstraintChange(HorizontalConstraint.Right);
  };

  return (
    <svg
      version="1.0"
      xmlns="http://www.w3.org/2000/svg"
      width="228.000000pt"
      height="228.000000pt"
      viewBox="0 0 228.000000 228.000000"
      preserveAspectRatio="xMidYMid meet"
    >
      <g transform="translate(0.000000,228.000000) scale(0.100000,-0.100000)" fill="#000000" stroke="none">
        <path
          fill="#e5e5e5"
          d="M198 2028 l-28 -32 0 -912 0 -912 31 -31 31 -31 915 0 915 0 29 29
29 29 0 917 0 917 -27 29 -28 29 -920 0 -920 0 -27 -32z m1876 -17 c15 -16 16
-98 16 -927 0 -860 -1 -909 -18 -926 -17 -17 -66 -18 -927 -18 -862 0 -910 1
-927 18 -17 17 -18 65 -18 926 0 832 1 911 16 927 16 18 45 19 468 21 248 2
659 2 912 0 431 -2 462 -4 478 -21z"
        />
        <path
          className={styles.topConstraint}
          onClick={onClickTopConstraint}
          fill="#fff"
          d="M1125 1968 c-3 -8 -4 -66 -3 -129 3 -106 4 -114 23 -114 19 0 20 7
20 125 0 111 -2 125 -18 128 -9 2 -19 -3 -22 -10z"
        />
        <path
          onClick={onClickBottomConstraint}
          fill="#fff"
          d="M1125 438 c-3 -8 -4 -66 -3 -129 3 -106 4 -114 23 -114 19 0 20 7 20
125 0 111 -2 125 -18 128 -9 2 -19 -3 -22 -10z"
        />
        <path
          onClick={onClickLeftConstraint}
          fill="#fff"
          d="M253 1095 c-11 -30 12 -36 133 -33 111 3 119 4 119 23 0 19 -8 20
-123 23 -105 2 -123 0 -129 -13z"
        />
        <path
          onClick={onClickRightConstraint}
          fill="#fff"
          d="M1783 1095 c-11 -30 12 -36 133 -33 111 3 119 4 119 23 0 19 -8 20
-123 23 -105 2 -123 0 -129 -13z"
        />
        <path
          fill="#fff"
          d="M568 1669 c-17 -9 -18 -48 -18 -584 0 -558 1 -575 19 -585 27 -14
1125 -14 1152 0 18 10 19 27 19 580 0 504 -2 570 -16 584 -14 14 -80 16 -577
16 -363 -1 -568 -4 -579 -11z m1119 -42 c4 -5 4 -1079 0 -1084 -5 -4 -1079 -4
-1084 0 -5 6 -4 1077 1 1085 4 7 1076 6 1083 -1z"
        />
        <rect height="46.46269" width="3.68657" y="96.08956" x="113.11941" fill="#fff" />
        <rect height="3.73134" width="46.04478" y="117.64181" x="91.82091" fill="#fff" />
        {/* <path
          fill="#fff"
          d="M1125 1310 c-4 -6 -5 -55 -3 -108 l3 -96 -105 -1 c-98 0 -105 -1
-105 -20 0 -19 7 -20 105 -20 l104 -1 1 -104 c0 -98 1 -105 20 -105 19 0 20 7
20 105 l1 104 104 1 c98 0 105 1 105 20 0 19 -7 20 -105 20 l-104 1 -1 104 c0
89 -2 105 -17 108 -9 2 -19 -2 -23 -8z"
        /> */}
      </g>
    </svg>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  topConstraint: css`
    :hover {
      d: path ('M10,30 A20,20 0,0,1 50,30 A20,20 0,0,1 90,30 Q90,60 50,90 Q10,60 10,30 z M5,5 L90,90');
    }
  `,
});
