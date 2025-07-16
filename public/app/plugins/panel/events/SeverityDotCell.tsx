import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface SeverityDotCellProps {
    value: any;
    field: any;
    rowIndex: number;
}

export const SeverityDotCell: React.FC<SeverityDotCellProps> = ({ value, field }) => {
    const styles = useStyles2(getSeverityDotStyles, { severity: value });

    return (
        <div className={styles.container}>
            <div className={styles.dot} />
        </div>
    );
};

interface SeverityDotStylesProps {
    severity: string;
}

const getSeverityDotStyles = (theme: GrafanaTheme2, props: SeverityDotStylesProps) => {
    const size = theme.spacing(1.5);
    const severity = (props.severity || 'unknown').toLowerCase();

    let backgroundColor = theme.colors.secondary.main;

    switch (severity) {
        case 'error':
            backgroundColor = theme.colors.error.main;
            break;
        case 'warning':
            backgroundColor = theme.colors.warning.main;
            break;
        case 'info':
            backgroundColor = theme.colors.info.main;
            break;
        case 'unknown':
        default:
            backgroundColor = theme.colors.text.secondary;
            break;
    }

    return {
        container: css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
        }),
        dot: css({
            width: size,
            height: size,
          // eslint-disable-next-line @grafana/no-border-radius-literal
            borderRadius: '50%',
            backgroundColor: backgroundColor,
            display: 'inline-block',
        }),
    };
};
