export const calculateAndPostLogsNewHeight = () => {
  const scrollbar = document.querySelector('.scrollbar-view');
  const panelTitle = document.querySelector('.panel-title');
  if (scrollbar && panelTitle) {
    const height = `${scrollbar?.scrollHeight + panelTitle?.clientHeight}px`;
    window.parent.postMessage(height, '*');
  }
};
