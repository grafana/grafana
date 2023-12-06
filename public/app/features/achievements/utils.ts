export const getProgress = (current: number, total: number) => {
  return Math.round((current / total) * 100);
};
