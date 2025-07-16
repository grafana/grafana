import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

interface TagsCellProps {
    value: any;
    field: any;
    rowIndex: number;
}

export const TagsCell: React.FC<TagsCellProps> = ({ value }) => {
    const theme = useTheme2();
    const styles = useStyles2(getTagsStyles, { theme });

    if (!value || value === '') {
        return <span />;
    }

    // Split tags and prioritize host tag
    const tags = value.split(', ');

    // Find host tag and move it to the front
    const hostTagIndex = tags.findIndex((tag: string) => tag.toLowerCase().startsWith('host:'));
    let prioritizedTags = [...tags];
    if (hostTagIndex > 0) {
        const hostTag = tags[hostTagIndex];
        prioritizedTags.splice(hostTagIndex, 1);
        prioritizedTags.unshift(hostTag);
    }

    if (prioritizedTags.length <= 2) {
        return (
            <span>
                {prioritizedTags.map((tag: string, index: number) => (
                    <span key={index} className={styles.tag}>
                        {tag}
                    </span>
                ))}
            </span>
        );
    } else {
        const firstTwoTags = prioritizedTags.slice(0, 2);
        const remainingCount = prioritizedTags.length - 2;
        return (
            <span>
                {firstTwoTags.map((tag: string, index: number) => (
                    <span key={index} className={styles.tag}>
                        {tag}
                    </span>
                ))}
                <span className={styles.moreBadge}>+{remainingCount} more</span>
            </span>
        );
    }
};

interface TagsStylesProps {
    theme: GrafanaTheme2;
}

const getTagsStyles = (theme: GrafanaTheme2, props: TagsStylesProps) => {
    return {
        tag: css({
            display: 'inline-block',
            background: theme.colors.background.secondary,
            color: theme.colors.text.primary,
            border: `1px solid ${theme.colors.border.medium}`,
            borderRadius: theme.shape.radius.default,
            padding: theme.spacing(0.25, 0.5),
            fontSize: theme.typography.size.sm,
            marginRight: theme.spacing(0.5),
            marginBottom: theme.spacing(0.25),
        }),
        moreBadge: css({
            display: 'inline-block',
            background: theme.colors.secondary.main,
            color: theme.colors.secondary.contrastText,
            border: `1px solid ${theme.colors.border.medium}`,
            borderRadius: theme.shape.radius.default,
            padding: theme.spacing(0.25, 1),
            fontSize: theme.typography.size.sm,
            marginLeft: theme.spacing(1),
        }),
    };
};
