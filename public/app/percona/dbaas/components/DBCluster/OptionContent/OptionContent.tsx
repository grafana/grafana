import React, { FC } from 'react';

import { styles } from './OptionContent.styles';

interface OptionContentProps {
  title: string;
  description?: string;
  tags: string[];
  disabledTags?: string[];
  dataTestId?: string;
}

export const OptionContent: FC<React.PropsWithChildren<OptionContentProps>> = ({ title, description, tags, disabledTags, dataTestId }) => (
  <div className={styles.optionWrapper} data-testid={dataTestId}>
    <div className={styles.optionText}>
      <span className={styles.optionTitle}>{title}</span>
      <span className={styles.optionDescription}>{description}</span>
    </div>
    <div className={styles.tagWrapper}>
      {disabledTags &&
        disabledTags.map((tag) => (
          <span key={tag} className={styles.notAvailableTag}>
            {tag}
          </span>
        ))}
      {tags.map((tag) => (
        <span key={tag} className={styles.tag}>
          {tag}
        </span>
      ))}
    </div>
  </div>
);
