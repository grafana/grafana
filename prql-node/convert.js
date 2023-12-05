import prqljs from "prql-js";

const prql = process.argv[2];

// TODO - need valid prql from ui
const prql2 = `
from employees
filter start_date > @2021-01-01
derive {
  gross_salary = salary + (tax ?? 0),
  gross_cost = gross_salary + benefits_cost,
}
filter gross_cost > 0
group {title, country} (
  aggregate {
    average gross_salary,
    sum_gross_cost = sum gross_cost,
  }
)
filter sum_gross_cost > 100_000
derive id = f"{title}_{country}"
derive country_code = s"LEFT(country, 2)"
sort {sum_gross_cost, -country}
take 1..20`

const sql = prqljs.compile(prql2);
console.log(sql);
