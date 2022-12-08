import axios from 'axios';

export const applyStep = async (recipeId: string, stepNumber: number) => {
  const { data } = await axios.post(`/api/plugin-recipes/${recipeId}/${stepNumber}/apply`);
  return data;
};
