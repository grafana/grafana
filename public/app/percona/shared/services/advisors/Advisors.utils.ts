import { Advisor, CategorizedAdvisor, Family } from './Advisors.types';

export const groupAdvisorsIntoCategories = (advisors: Advisor[]): CategorizedAdvisor => {
  const result: CategorizedAdvisor = {};

  advisors.forEach((advisor) => {
    const { category, summary, checks } = advisor;

    const modifiedChecks = checks.map((check) => ({
      ...check,
      family: check.family ? Family[check.family] : undefined,
    }));

    if (!result[category]) {
      result[category] = {};
    }

    if (!result[category][summary]) {
      result[category][summary] = { ...advisor, checks: [...modifiedChecks] };
    }
  });
  return result;
};
