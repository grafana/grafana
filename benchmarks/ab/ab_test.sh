#!/bin/bash

ab -n 20000 -c 100 -H "Authorization: Bearer vEustw23NSOZ27y3zlj28ZL3B7BpBk5kqR85DOfT5AwiS3nCi33dnsk6nhvXhZdn" \
  http://localhost:3000/api/dashboards/db/dash1
