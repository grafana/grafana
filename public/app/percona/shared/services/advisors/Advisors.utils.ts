import { Advisor, CategorizedAdvisor } from './Advisors.types';

export const groupAdvisorsIntoCategories = (advisors: Advisor[]): CategorizedAdvisor => {
  const result: CategorizedAdvisor = {};

  advisors.forEach((advisor) => {
    const { category, summary } = advisor;

    if (!result[category]) {
      result[category] = {};
    }

    if (!result[category][summary]) {
      result[category][summary] = advisor;
    }
  });
  return result;
};
