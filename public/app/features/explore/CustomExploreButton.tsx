import { ToolbarButton } from '@grafana/ui';
import { Trans, t } from '@grafana/i18n';

interface CustomExploreButtonProps {
  exploreId: string;
  splitted?: boolean;
}

export function CustomExploreButton({ exploreId, splitted }: CustomExploreButtonProps) {
  const handleClick = () => {
    // Custom button logic - you can modify this as needed
    console.log('Custom button clicked for explore pane:', exploreId);
    
    // Example: Show an alert with the explore pane ID
    alert(`Custom action triggered for explore pane: ${exploreId}`);
    
    // Here you could:
    // - Dispatch Redux actions
    // - Open modals or drawers
    // - Trigger API calls
    // - Navigate to other views
    // - Export data
    // - etc.
  };

  return (
    <ToolbarButton
      variant="canvas"
      tooltip={t('explore.custom-button.tooltip', 'Trigger custom action')}
      icon="rocket" // Using rocket icon for the custom action
      iconOnly={splitted} // Hide text when in split view to save space
      onClick={handleClick}
    >
      <Trans i18nKey="explore.custom-button.text">Custom Action</Trans>
    </ToolbarButton>
  );
}