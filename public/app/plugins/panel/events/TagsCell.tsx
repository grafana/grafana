import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { TagsPopup } from './TagsPopup';

interface TagsCellProps {
    value: any;
    field: any;
    rowIndex: number;
}

export const TagsCell: React.FC<TagsCellProps> = ({ value }) => {
    const theme = useTheme2();
    const styles = useStyles2(getTagsStyles, { theme });
    const [isPopupOpen, setIsPopupOpen] = useState(false);

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

    // Show max 2 tags, then "X more"
    const maxVisibleTags = 2;
    const visibleTags = prioritizedTags.slice(0, maxVisibleTags);
    const remainingCount = prioritizedTags.length - maxVisibleTags;

    const handleMoreClick = () => {
        setIsPopupOpen(true);
    };

    const handlePopupDismiss = () => {
        setIsPopupOpen(false);
    };

    return (
        <span className={styles.container}>
            {visibleTags.map((tag: string, index: number) => (
                <span key={index} className={styles.tag}>
                    {tag}
                </span>
            ))}
            {remainingCount > 0 && (
                <button
                    type="button"
                    className={styles.moreBadge}
                    onClick={handleMoreClick}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleMoreClick();
                        }
                    }}
                >
                    +{remainingCount} more
                </button>
            )}
            <TagsPopup
                isOpen={isPopupOpen}
                onDismiss={handlePopupDismiss}
                tags={prioritizedTags}
            />
        </span>
    );
};

interface TagsStylesProps {
    theme: GrafanaTheme2;
}

const getTagsStyles = (theme: GrafanaTheme2, props: TagsStylesProps) => {
    return {
        container: css({
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
        }),
        tag: css({
            display: 'inline-block',
            background: theme.colors.background.secondary,
            color: theme.colors.text.primary,
            border: `1px solid ${theme.colors.border.medium}`,
            borderRadius: theme.shape.radius.default,
            padding: theme.spacing(0.25, 0.5),
            fontSize: theme.typography.size.sm,
            marginRight: theme.spacing(0.5),
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '150px', // Shorter max width for truncation
            flexShrink: 0, // Prevent tags from shrinking
        }),
        moreBadge: css({
            display: 'inline-block',
            background: theme.colors.secondary.main,
            color: theme.colors.secondary.contrastText,
            border: `1px solid ${theme.colors.border.medium}`,
            borderRadius: theme.shape.radius.default,
            padding: theme.spacing(0.25, 0.75),
            fontSize: theme.typography.size.sm,
            marginLeft: theme.spacing(0.5),
            // eslint-disable-next-line @grafana/no-unreduced-motion
            transition: 'background-color 0.2s ease',
            whiteSpace: 'nowrap',
            flexShrink: 0, // Prevent badge from shrinking
            cursor: 'pointer',
            outline: 'none',
            '&:hover': {
                background: theme.colors.secondary.shade,
            },
            '&:focus': {
                outline: `2px solid ${theme.colors.primary.main}`,
                outlineOffset: '2px',
            },
        }),
    };
};
