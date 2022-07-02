export const closePopover = (event: React.KeyboardEvent, hidePopper: () => void) => {
  if (event.key === 'Tab' || event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  event.stopPropagation();

  if (event.key === 'Escape') {
    hidePopper();
  }

  return;
};
