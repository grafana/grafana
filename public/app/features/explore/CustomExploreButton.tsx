import { ToolbarButton } from '@grafana/ui';
import { Trans, t } from '@grafana/i18n';

interface CustomExploreButtonProps {
  exploreId: string;
  splitted?: boolean;
}

export function CustomExploreButton({ exploreId, splitted }: CustomExploreButtonProps) {
  const handleClick = () => {
    // Convert to Sigma button logic - you can modify this as needed
    console.log('Convert to Sigma clicked for explore pane:', exploreId);
    
    // Example: Show an alert with the explore pane ID
    alert(`Converting to Sigma for explore pane: ${exploreId}`);
    
    // Here you could:
    // - Dispatch Redux actions to convert query to Sigma format
    // - Open Sigma conversion modal or drawer
    // - Trigger API calls to Sigma service
    // - Navigate to Sigma view
    // - Export data in Sigma format
    // - etc.
  };

  return (
    <ToolbarButton
      variant="primary"
      tooltip={t('explore.sigma-button.tooltip', 'Convert to Sigma')}
      iconOnly={splitted} // Hide text when in split view to save space
      onClick={handleClick}
    >
      <Trans i18nKey="explore.sigma-button.text">🔄 Convert to Sigma</Trans>
    </ToolbarButton>
  );
}