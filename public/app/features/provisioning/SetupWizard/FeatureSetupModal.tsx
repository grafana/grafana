import React, { useState } from 'react';
import { Modal, Button, useStyles2, Alert, Box } from '@grafana/ui';
import { getStyles } from './styles';
import { FeatureSetupModalProps } from './types';
import { CompactFeaturesList } from './CompactFeaturesList';
import { InstructionsModal } from './InstructionsModal';

export const FeatureSetupModal = ({ features, isOpen, onDismiss, hasRequiredFeatures }: FeatureSetupModalProps) => {
  const styles = useStyles2(getStyles);
  const [selectedFeature, setSelectedFeature] = useState<number | null>(null);

  const handleFeatureSelect = (index: number) => {
    setSelectedFeature(index);
  };

  const handleInstructionsClose = () => {
    setSelectedFeature(null);
  };

  // Separate required and optional features
  const requiredFeatures = features.filter((feature) => feature.additional);
  const optionalFeatures = features.filter((feature) => !feature.additional);

  return (
    <>
      <Modal
        isOpen={isOpen && selectedFeature === null}
        title="Feature Setup"
        onDismiss={onDismiss}
        className={styles.container}
      >
        <div className={styles.content}>
          {!hasRequiredFeatures && (
            <Alert severity="warning" title="Required Features Not Configured">
              Some required features are not properly configured. Please complete the setup for these features to ensure
              full functionality.
            </Alert>
          )}

          {requiredFeatures.length > 0 && (
            <>
              <h3 className={styles.title}>Required Features</h3>
              <p className={styles.subtitle}>
                These features are required for full functionality. Please complete their setup.
              </p>
              <div className={styles.featuresList}>
                {requiredFeatures.map((feature, index) => {
                  const featureIndex = features.findIndex((f) => f.title === feature.title);
                  const allStepsFulfilled = feature.steps.every((step) => step.fulfilled);

                  return (
                    <div key={index} className={styles.featureItem}>
                      <h4 className={styles.featureTitle}>
                        {feature.title}
                        {allStepsFulfilled && <span className={styles.fulfilledBadge}>Completed</span>}
                      </h4>
                      <p className={styles.featureDescription}>{feature.description}</p>
                      <Button
                        variant="primary"
                        onClick={() => handleFeatureSelect(featureIndex)}
                        className={styles.featureButton}
                      >
                        {allStepsFulfilled ? 'View Setup' : 'Setup Now'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {optionalFeatures.length > 0 && (
            <>
              <Box marginTop={4}>
                <h3 className={styles.title}>Optional Features</h3>
                <p className={styles.subtitle}>
                  These features are optional but can enhance your experience. Set them up as needed.
                </p>
                <div className={styles.featuresList}>
                  {optionalFeatures.map((feature, index) => {
                    const featureIndex = features.findIndex((f) => f.title === feature.title);
                    const allStepsFulfilled = feature.steps.every((step) => step.fulfilled);

                    return (
                      <div key={index} className={styles.featureItem}>
                        <h4 className={styles.featureTitle}>
                          {feature.title}
                          {allStepsFulfilled && <span className={styles.fulfilledBadge}>Completed</span>}
                        </h4>
                        <p className={styles.featureDescription}>{feature.description}</p>
                        <Button
                          variant="secondary"
                          onClick={() => handleFeatureSelect(featureIndex)}
                          className={styles.featureButton}
                        >
                          {allStepsFulfilled ? 'View Setup' : 'Setup Now'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </Box>
            </>
          )}
        </div>
        <div className={styles.footer}>
          <Button variant="secondary" onClick={onDismiss}>
            Close
          </Button>
        </div>
      </Modal>

      {selectedFeature !== null && (
        <InstructionsModal feature={features[selectedFeature]} isOpen={true} onDismiss={handleInstructionsClose} />
      )}
    </>
  );
};
