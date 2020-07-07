FROM debian:buster-slim 
USER root 
ADD scripts scripts
ADD install /usr/local
RUN cd scripts && ./deploy.sh
