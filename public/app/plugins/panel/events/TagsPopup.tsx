import { css } from '@emotion/css';
import React, { useState, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Modal, Input, Button, Icon, useStyles2, useTheme2 } from '@grafana/ui';

interface TagsPopupProps {
    isOpen: boolean;
    onDismiss: () => void;
    tags: string[];
}

export const TagsPopup: React.FC<TagsPopupProps> = ({ isOpen, onDismiss, tags }) => {
    const theme = useTheme2();
    const styles = useStyles2(getTagsPopupStyles, { theme });
    const [searchQuery, setSearchQuery] = useState('');

    // Filter tags based on search query
    const filteredTags = useMemo(() => {
        if (!searchQuery) {
            return tags;
        }
        return tags.filter(tag =>
            tag.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [tags, searchQuery]);

    const handleCopyAll = () => {
        const tagsText = tags.join(', ');
        navigator.clipboard.writeText(tagsText).then(() => {
            // Could add a toast notification here if needed
        });
    };

    return (
        <Modal
            title="Tags"
            isOpen={isOpen}
            onDismiss={onDismiss}
            closeOnBackdropClick={true}
            closeOnEscape={true}
            className={styles.modal}
        >
            <div className={styles.container}>
                <div className={styles.searchContainer}>
                    <Input
                        placeholder={`Filter all ${tags.length} tags`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.currentTarget.value)}
                        prefix={<Icon name="search" />}
                        className={styles.searchInput}
                    />
                    <Button
                        variant="secondary"
                        onClick={handleCopyAll}
                        icon="copy"
                        className={styles.copyButton}
                    >
                        Copy All
                    </Button>
                </div>

                <div className={styles.tagsContainer}>
                    {filteredTags.length === 0 ? (
                        <div className={styles.noResults}>
                            No tags match your search
                        </div>
                    ) : (
                        filteredTags.map((tag, index) => (
                            <div key={index} className={styles.tagRow}>
                                <span className={styles.tag}>
                                    {tag}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Modal>
    );
};

interface TagsPopupStylesProps {
    theme: GrafanaTheme2;
}

const getTagsPopupStyles = (theme: GrafanaTheme2, props: TagsPopupStylesProps) => {
    return {
        modal: css({
            width: '500px',
            maxWidth: '90vw',
        }),
        container: css({
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing(2),
        }),
        searchContainer: css({
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing(1),
            borderBottom: `1px solid ${theme.colors.border.weak}`,
            paddingBottom: theme.spacing(2),
        }),
        searchInput: css({
            flex: 1,
        }),
        copyButton: css({
            flexShrink: 0,
        }),
        tagsContainer: css({
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing(0.75),
            maxHeight: '300px',
            overflowY: 'auto',
        }),
        tagRow: css({
            display: 'flex',
            width: '100%',
            padding: theme.spacing(0.25, 0),
        }),
        tag: css({
            display: 'inline-block',
            background: theme.colors.background.secondary,
            color: theme.colors.text.primary,
            border: `1px solid ${theme.colors.border.medium}`,
            borderRadius: theme.shape.radius.default,
            padding: theme.spacing(0.25, 0.5),
            fontSize: theme.typography.size.sm,
        }),
        noResults: css({
            color: theme.colors.text.secondary,
            fontStyle: 'italic',
            textAlign: 'center',
            padding: theme.spacing(2),
        }),
    };
};
