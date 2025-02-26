import React from 'react';
import { useStyles2, Icon, Tooltip } from '@grafana/ui';
import { getCompactStyles } from './styles';
import { CompactFeaturesListProps } from './types';

export const CompactFeaturesList = ({ features }: CompactFeaturesListProps) => {
  const styles = useStyles2(getCompactStyles);

  return (
    <div className={styles.featuresList}>
      {features.map((feature, index) => (
        <div key={index} className={styles.featureItem}>
          <Icon name="circle" className={styles.bulletPoint} />
          <div className={styles.featureContent}>
            <div className={styles.titleWithInfo}>
              {feature.title}
              <Tooltip content={feature.description} placement="top">
                <button className={styles.infoButton}>
                  <Icon name="info-circle" />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
