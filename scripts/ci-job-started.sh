#!/bin/bash

echo -e "Collecting job start date"

start=$(date +%s%N)
export GF_JOB_START=$start
