import axios from 'axios';

export const useRevertStep = async (recipeId: string, stepNumber: number) => {
  const { data } = await axios.post(`/api/plugin-recipes/${recipeId}/${stepNumber}/revert`);
  return data;
};
